/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.apache.ignite.logger.log4j2;

import junit.framework.*;
import org.apache.ignite.*;
import org.apache.ignite.configuration.*;
import org.apache.ignite.internal.util.typedef.*;
import org.apache.ignite.internal.util.typedef.internal.*;
import org.apache.ignite.logger.*;
import org.apache.ignite.spi.discovery.tcp.*;
import org.apache.ignite.spi.discovery.tcp.ipfinder.vm.*;
import org.apache.ignite.testframework.*;
import org.apache.ignite.testframework.junits.common.*;
import org.apache.logging.log4j.*;

import java.io.*;
import java.util.*;

/**
 * Grid Log4j2 SPI test.
 */
@GridCommonTest(group = "Logger")
public class GridLog4j2SelfTest extends TestCase {
    /** */
    public static final String LOG_PATH_TEST = "modules/core/src/test/config/log4j2-test.xml";

    /** */
    public static final String LOG_PATH_VERBOSE_TEST = "modules/core/src/test/config/log4j2-verbose-test.xml";

    /** */
    public static final String LOG_PATH_MAIN = "config/ignite-log4j2.xml";

    /**
     * @throws Exception If failed.
     */
    public void testFileConstructor() throws Exception {
        File xml = GridTestUtils.resolveIgnitePath(LOG_PATH_TEST);

        assert xml != null;
        assert xml.exists();

        IgniteLogger log = new Log4J2Logger(xml).getLogger(getClass());

        ((LoggerNodeIdAware) log).setNodeId(UUID.randomUUID());

        checkLog(log);
    }

    /**
     * @throws Exception If failed.
     */
    public void testUrlConstructor() throws Exception {
        File xml = GridTestUtils.resolveIgnitePath(LOG_PATH_TEST);

        assert xml != null;
        assert xml.exists();

        IgniteLogger log = new Log4J2Logger(xml.toURI().toURL()).getLogger(getClass());

        ((LoggerNodeIdAware) log).setNodeId(UUID.randomUUID());

        checkLog(log);
    }

    /**
     * @throws Exception If failed.
     */
    public void testPathConstructor() throws Exception {
        IgniteLogger log = new Log4J2Logger(LOG_PATH_TEST).getLogger(getClass());

        ((LoggerNodeIdAware) log).setNodeId(UUID.randomUUID());

        checkLog(log);
    }

    /**
     * Tests log4j logging SPI.
     */
    private void checkLog(IgniteLogger log) {
        assert !log.isDebugEnabled();
        assert log.isInfoEnabled();

        log.debug("This is 'debug' message.");
        log.info("This is 'info' message.");
        log.warning("This is 'warning' message.");
        log.warning("This is 'warning' message.", new Exception("It's a test warning exception"));
        log.error("This is 'error' message.");
        log.error("This is 'error' message.", new Exception("It's a test error exception"));
    }

    /**
     * @throws Exception If failed.
     */
    public void testSystemNodeId() throws Exception {
        UUID id = UUID.randomUUID();

        new Log4J2Logger(LOG_PATH_TEST).setNodeId(id);

        assertEquals(U.id8(id), System.getProperty("nodeId"));
    }

    /**
     * Test can be run from IDE
     *
     * @throws Exception If failed.
     */
    public void _testVerboseMode() throws Exception {
        final PrintStream backupSysOut = System.out;
        final PrintStream backupSysErr = System.err;

        final ByteArrayOutputStream testOut = new ByteArrayOutputStream();
        final ByteArrayOutputStream testErr = new ByteArrayOutputStream();

        try {
            System.setOut(new PrintStream(testOut));
            System.setErr(new PrintStream(testErr));

            System.setProperty("IGNITE_QUIET", "false");

            try (Ignite ignite = G.start(getConfiguration("verboseLogGrid", LOG_PATH_VERBOSE_TEST))) {
                String testMsg = "******* Hello Tester! ******* ";

                ignite.log().error(testMsg + Level.ERROR);
                ignite.log().warning(testMsg + Level.WARN);
                ignite.log().info(testMsg + Level.INFO);
                ignite.log().debug(testMsg + Level.DEBUG);
                ignite.log().trace(testMsg + Level.TRACE);

                String consoleOut = testOut.toString();
                String consoleErr = testErr.toString();

                assertTrue(consoleOut.contains(testMsg + Level.INFO));
                assertTrue(consoleOut.contains(testMsg + Level.DEBUG));
                assertTrue(consoleOut.contains(testMsg + Level.TRACE));

                assertTrue(consoleErr.contains(testMsg + Level.ERROR));
                assertTrue(consoleErr.contains(testMsg + Level.WARN));

                assertTrue(!consoleOut.contains(testMsg + Level.ERROR));
                assertTrue(!consoleOut.contains(testMsg + Level.WARN));

                assertTrue(!consoleErr.contains(testMsg + Level.INFO));
                assertTrue(!consoleErr.contains(testMsg + Level.DEBUG));
                assertTrue(!consoleErr.contains(testMsg + Level.TRACE));
            }
        }
        finally {
            System.setProperty("IGNITE_QUIET", "true");

            System.setOut(backupSysOut);
            System.setErr(backupSysErr);

            System.out.println("**************** Out Console content ***************");
            System.out.println(testOut.toString());

            System.err.println("**************** Err Console content ***************");
            System.err.println(testErr.toString());
        }
    }

    /**
     * Tests correct behaviour in case 2 local nodes are started.
     *
     * @throws Exception If error occurs.
     */
    public void testLogFilesTwoNodes() throws Exception {
        checkOneNode(0);
        checkOneNode(1);
    }

    /**
     * Starts the local node and checks for presence of log file.
     * Also checks that this is really a log of a started node.
     *
     * @param id Test-local node ID.
     * @throws Exception If error occurred.
     */
    private void checkOneNode(int id) throws Exception {
        String id8;
        File logFile;

        try (Ignite ignite = G.start(getConfiguration("grid" + id, LOG_PATH_MAIN))) {
            id8 = U.id8(ignite.cluster().localNode().id());

            String logPath = "work/log/ignite-" + id8 + ".log";

            logFile = U.resolveIgnitePath(logPath);
            assertNotNull("Failed to resolve path: " + logPath, logFile);
            assertTrue("Log file does not exist: " + logFile, logFile.exists());

            assertEquals(logFile.getAbsolutePath(), ignite.log().fileName());
        }
        String logContent = U.readFileToString(logFile.getAbsolutePath(), "UTF-8");

        assertTrue("Log file does not contain it's node ID: " + logFile,
            logContent.contains(">>> Local node [ID="+ id8.toUpperCase()));

    }

    /**
     * Creates grid configuration.
     *
     * @param gridName Grid name.
     * @param logPath Logger configuration path.
     * @return Grid configuration.
     * @throws Exception If error occurred.
     */
    private static IgniteConfiguration getConfiguration(String gridName, String logPath)
        throws Exception {
        TcpDiscoverySpi disco = new TcpDiscoverySpi();

        disco.setIpFinder(new TcpDiscoveryVmIpFinder(false) {{
            setAddresses(Collections.singleton("127.0.0.1:47500..47509"));
        }});

        IgniteConfiguration cfg = new IgniteConfiguration()
            .setGridName(gridName)
            .setGridLogger(new Log4J2Logger(logPath))
            .setConnectorConfiguration(null)
            .setDiscoverySpi(disco);

        return cfg;
    }
}